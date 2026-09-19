"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowThumbnail({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <span
      className={cn(
        "relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#EAEBE7] text-[#8F8F8F]",
        className,
      )}
    >
      {src && failedSrc !== src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="96px"
          className="object-cover"
          unoptimized
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Package size={20} aria-hidden />
      )}
    </span>
  );
}
