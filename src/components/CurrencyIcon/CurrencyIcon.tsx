import Image from "next/image";

type CurrencyIconProps = {
  src: string;
  alt: string;
  size?: number;
  className?: string;
};

export default function CurrencyIcon({
  src,
  alt,
  size = 28,
  className = "",
}: CurrencyIconProps) {
  const inner = Math.round(size * 0.72);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center self-center rounded-lg bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={inner}
        height={inner}
        className="block object-contain object-center"
        style={{ width: inner, height: inner }}
        unoptimized
      />
    </span>
  );
}
