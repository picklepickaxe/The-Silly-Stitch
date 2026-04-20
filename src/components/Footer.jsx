import { Link } from "react-router-dom";

const QUICK_LINKS = [
	{ label: "Home", to: "/" },
	{ label: "Shop", to: "/shop" },
	{ label: "Contact", to: "/contact" },
];

export default function Footer() {
	return (
		<footer className="border-t border-yarn/20 bg-[#fdf6e3] dark:bg-[#131022] text-text dark:text-[#d7c8ea] transition-colors duration-300">
			<div className="border-b border-yarn/20 bg-white/90 dark:border-[#4a3a66] dark:bg-[#1d1833]">
				<div className="mx-auto max-w-6xl px-6 py-4 text-center text-base font-semibold tracking-[0.08em] text-yarn dark:text-[#d7c1eb] sm:text-lg">
					𓇼 ⋆.˚ 𓆉 𓆝 𓆡⋆.˚ 𓇼
				</div>
			</div>

			<div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
				<div className="grid gap-10 text-sm md:grid-cols-3">
					<div className="space-y-3">
						<p className="text-2xl font-semibold text-yarn dark:text-[#d8bfeb]">
							The <span className="font-poiret text-3xl">Silly</span> Stitch
						</p>
						<p className="text-text/75 dark:text-[#b7a0cb]">Handmade with love &hearts;</p>
						<a
							href="https://instagram.com/theSilly.Stitch"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-2 text-yarn dark:text-[#cdb5df] hover:opacity-80 transition"
						>
							Instagram
						</a>
					</div>

					<div className="space-y-3">
						<p className="text-xs uppercase tracking-[0.2em] text-text/50 dark:text-[#8f7aa4]">Quick Links</p>
						<div className="flex flex-wrap gap-4 text-sm">
							{QUICK_LINKS.map((link) => (
								<Link
									key={link.to}
									to={link.to}
									className="text-text/80 dark:text-[#ccb7df] hover:text-yarn dark:hover:text-white transition"
								>
									{link.label}
								</Link>
							))}
						</div>
					</div>

					<div className="space-y-3 md:text-right">
						<p className="text-xs uppercase tracking-[0.2em] text-text/50 dark:text-[#8f7aa4]">Made By</p>
						<p className="font-medium text-text/85 dark:text-[#d9caea]">Aviral Kakodia</p>
						<div className="space-x-4 text-sm">
							<a
								href="https://www.linkedin.com/"
								target="_blank"
								rel="noreferrer"
								className="text-yarn dark:text-[#cdb5df] hover:opacity-80 transition"
							>
								LinkedIn
							</a>
							<a
								href="mailto:aviralkakodia27@gmail.com"
								className="text-yarn dark:text-[#cdb5df] hover:opacity-80 transition"
							>
								Email
							</a>
						</div>
					</div>
				</div>

				<div className="mt-8 border-t border-yarn/15 pt-4 text-center text-xs text-text/55 dark:text-[#9b82b0]">
					&copy; 2026 The Silly Stitch. All rights reserved.
				</div>
			</div>
		</footer>
	);
}
