type PageHeaderProps = {
  label: string;
  title: string;
  description?: string;
};

export function PageHeader({ label, title, description }: PageHeaderProps) {
  return (
    <section className="section-light border-b border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 pt-36 pb-16 lg:px-10 lg:pt-44 lg:pb-20">
        <p className="section-label mb-6">{label}</p>
        <h1 className="headline max-w-[18ch]">{title}</h1>
        {description && <p className="body-lg mt-6 max-w-2xl">{description}</p>}
      </div>
    </section>
  );
}
