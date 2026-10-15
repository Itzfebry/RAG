import { sectionHeaderWrap, sectionDescCls, tPage } from "./adminStyles";

export function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={sectionHeaderWrap}>
      <h2 className={tPage}>{title}</h2>
      <p className={sectionDescCls}>{desc}</p>
    </div>
  );
}
