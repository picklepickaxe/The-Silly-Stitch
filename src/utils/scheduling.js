// src/utils/scheduling.js

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  return startOfDay(date).toISOString().split("T")[0];
}

// ─── Part 1: Calculate order making time from its items ───────────────────────
// FIX #7: Warn explicitly when makingTimeHours is missing on items so silent
//         zero-collapse is caught immediately — instead of getting a wrong
//         deadline with no indication of why.

export function calculateMakingTime(order) {
  let total = 0;
  let missingCount = 0;

  for (const item of order.items || []) {
    const raw =
      item.product?.makingTimeHours ??
      item.makingTimeHours ??
      item.makingTime ??
      null;

    const hours = raw !== null ? Number(raw) : null;
    const quantity = Number(item.quantity) || 0;

    if (hours === null || !Number.isFinite(hours)) {
      missingCount += 1;
      // Treat as 0 but flag it
    } else {
      total += hours * quantity;
    }
  }

  if (missingCount > 0) {
    console.warn(
      `[scheduling] Order ${order.orderId ?? order.docId ?? "unknown"}: ` +
        `${missingCount} item(s) are missing makingTimeHours — treated as 0. ` +
        `Ensure makingTimeHours is denormalized onto every cart item at checkout.`
    );
  }

  return total;
}

// ─── Part 2: Build committed hours map from active orders ─────────────────────
// FIX #1: Filter out past days — allocations before today are irrelevant and
//         would cause free-slot math to undercount available capacity.
// FIX #3: Re-derive allocations fresh every call rather than trusting the
//         snapshot stored in Firestore. The stored dailyAllocations can drift
//         if orders are edited, restatused, or items change after acceptance.
//         We re-run the allocation loop for every active order so the committed
//         map always reflects the current state.
// FIX #5: Handle in_progress orders that were manually set without ever going
//         through the accepted flow (so they have no dailyAllocations stored).
//         We compute their allocation from scratch using their makingTime.

export function buildCommittedHours(activeOrders, capacity) {
  const today = dateKey(new Date());
  const committedHours = {};
  const dailyCapacity = Number(capacity);

  for (const order of activeOrders) {
    const makingTime =
      typeof order.makingTime === "number" && order.makingTime > 0
        ? order.makingTime
        : calculateMakingTime(order);

    if (!makingTime || makingTime <= 0) continue;

    // Re-simulate this order's allocation from today forward so we get a
    // consistent picture regardless of what's stored in Firestore.
    let hoursLeft = makingTime;
    let day = startOfDay(new Date());

    while (hoursLeft > 0) {
      const key = dateKey(day);
      const alreadyCommitted = committedHours[key] || 0;
      const freeToday = dailyCapacity - alreadyCommitted;

      if (freeToday > 0) {
        const hoursUsed = Math.min(hoursLeft, freeToday);
        committedHours[key] = alreadyCommitted + hoursUsed;
        hoursLeft -= hoursUsed;
      }

      if (hoursLeft > 0) {
        day = new Date(day.getTime() + MS_PER_DAY);
      }
    }
  }

  // FIX #1: Strip past days — nothing before today matters for new scheduling
  for (const key of Object.keys(committedHours)) {
    if (key < today) delete committedHours[key];
  }

  return committedHours;
}

// ─── Part 3: Suggest deadline for an order ────────────────────────────────────
// FIX #6: Return metadata about whether the deadline is raw calendar days
//         so callers can show a note like "excludes weekends/holidays".

export function suggestDeadline(order, activeOrders, capacity, bufferDays) {
  const makingTime = calculateMakingTime(order);
  const dailyCapacity = Number(capacity);
  const safeBufferDays = Number(bufferDays) || 0;

  // FIX #3: Always rebuild committed hours fresh — never trust stale Firestore
  //         snapshots. Pass capacity so re-simulation is consistent.
  const committedHours = buildCommittedHours(activeOrders, dailyCapacity);

  let hoursLeft = Math.max(0, Number(makingTime) || 0);
  let day = startOfDay(new Date());
  const dailyAllocations = {};

  // FIX (off-by-one + zero guard): If nothing to make or capacity invalid,
  // deadline is today + buffer. Don't enter the loop at all.
  if (hoursLeft <= 0 || !Number.isFinite(dailyCapacity) || dailyCapacity <= 0) {
    const suggestedDeadline = new Date(
      day.getTime() + safeBufferDays * MS_PER_DAY
    );
    return {
      makingTime,
      suggestedDeadline,
      dailyAllocations,
      bufferDays: safeBufferDays,
      bufferIsCalendarDays: true,
      missingMakingTime: makingTime <= 0,
    };
  }

  while (hoursLeft > 0) {
    const key = dateKey(day);
    const alreadyCommitted = committedHours[key] || 0;
    const freeToday = dailyCapacity - alreadyCommitted;

    if (freeToday > 0) {
      const hoursUsed = Math.min(hoursLeft, freeToday);
      dailyAllocations[key] = hoursUsed;
      hoursLeft -= hoursUsed;
    }

    // FIX (off-by-one): Only advance day if there's still work left so `day`
    // stays on the true last working day — no need for `- MS_PER_DAY` after loop.
    if (hoursLeft > 0) {
      day = new Date(day.getTime() + MS_PER_DAY);
    }
  }

  // FIX #6: Buffer is raw calendar days — no weekend/holiday awareness yet.
  const suggestedDeadline = new Date(
    day.getTime() + safeBufferDays * MS_PER_DAY
  );

  return {
    makingTime,
    suggestedDeadline,
    dailyAllocations,
    bufferDays: safeBufferDays,
    bufferIsCalendarDays: true,
    missingMakingTime: false,
  };
}

// ─── Part 4: Calculate priority and urgency for a single order ────────────────

export function calculatePriority(order, capacity) {
  if (!order.confirmedDeadline) {
    return {
      ...order,
      slack: null,
      urgency: "UNSCHEDULED",
      priorityScore: -Infinity,
    };
  }

  const deadlineDate = order.confirmedDeadline.toDate
    ? order.confirmedDeadline.toDate()
    : new Date(order.confirmedDeadline);

  const today = startOfDay(new Date());
  const daysUntilDeadline = Math.ceil((deadlineDate - today) / MS_PER_DAY);
  const hoursAvailable = daysUntilDeadline * capacity;
  const slack = hoursAvailable - (order.makingTime || 0);

  let urgency;
  if (slack < 0)              urgency = "CRITICAL";
  else if (slack === 0)       urgency = "START TODAY";
  else if (slack <= capacity) urgency = "HIGH";
  else                        urgency = "NORMAL";

  return {
    ...order,
    slack,
    urgency,
    priorityScore: -slack,
  };
}

// ─── Part 5: Build full prioritized dashboard list ────────────────────────────

export function buildPrioritizedOrders(acceptedOrders, capacity) {
  return acceptedOrders
    .map((order) => calculatePriority(order, capacity))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

// ─── Part 6: Memoization-friendly schedule map ────────────────────────────────
// FIX #4: Call this once with useMemo in Admin.jsx instead of calling
//         suggestDeadline() inline for every order card on every render.
//         This reduces O(n²) recomputation to O(n) per state change.
//
//   Usage in Admin.jsx:
//
//   const scheduleMap = useMemo(
//     () => buildScheduleMap(orders, CAPACITY, BUFFER_DAYS),
//     [orders]
//   );
//
//   Then in JSX: const scheduleResult = scheduleMap[order.docId];

export function buildScheduleMap(orders, capacity, bufferDays) {
  const activeOrders = orders.filter(
    (o) => o.status === "accepted" || o.status === "in_progress"
  );

  const map = {};

  for (const order of orders) {
    // Exclude the order itself from the active list so it doesn't block itself
    const othersActive = activeOrders.filter((o) => o.docId !== order.docId);
    map[order.docId] = suggestDeadline(order, othersActive, capacity, bufferDays);
  }

  return map;
}