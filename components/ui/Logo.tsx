"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function Logo({ width = 140, height = 40, className = "" }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by showing light logo initially
  const logoSrc = mounted && resolvedTheme === "dark"
    ? "/synapse-logo-horizontal-dark.png"
    : "/synapse-logo-horizontal.png";

  return (
    <Image
      src={logoSrc}
      alt="Synapse"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
