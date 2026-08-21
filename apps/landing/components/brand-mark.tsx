import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  priority?: boolean;
};

export function BrandMark({ className = "size-8", priority = false }: BrandMarkProps) {
  return (
    <Image
      data-brand-mark="true"
      src="/icon.png"
      alt=""
      width={64}
      height={64}
      priority={priority}
      className={className}
    />
  );
}
