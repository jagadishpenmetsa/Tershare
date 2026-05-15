type SectionHeaderProps = {
  title: string;
  description: string;
};

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <header className="mb-8 border-b border-black/10 pb-6 sm:mb-10 sm:pb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl md:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/55 sm:mt-3 sm:text-base">
        {description}
      </p>
    </header>
  );
}
