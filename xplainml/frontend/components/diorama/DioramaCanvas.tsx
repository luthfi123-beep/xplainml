"use client";

import dynamic from "next/dynamic";

const DioramaScene = dynamic(
  () => import("./DioramaScene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-sm text-neutral-500">
          Preparing 3D environment...
        </span>
      </div>
    ),
  }
);

export default function DioramaCanvas() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <DioramaScene />
    </div>
  );
}