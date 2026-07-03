export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h1 className="text-xl font-black text-ink md:text-2xl">{title}</h1>
      {action}
    </div>
  );
}
