export default function Footer() {
  return (
    <footer className="w-full border-t border-zinc-900 bg-black py-3 px-4">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
        <span>
          PinPic &copy; {new Date().getFullYear()} &mdash; Major Diploma Project
        </span>
        <span className="text-zinc-700">
          Built by <span className="text-zinc-400 font-bold">Arya Hemant Tare</span>
        </span>
      </div>
    </footer>
  );
}
