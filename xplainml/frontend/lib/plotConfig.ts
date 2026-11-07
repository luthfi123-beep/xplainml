export function getPlotConfig(filename: string, title?: string) {
  return {
    displayModeBar: true,
    modeBarButtonsToRemove: [
      "zoom2d", "pan2d", "select2d", "lasso2d",
      "resetScale2d", "zoomIn2d", "zoomOut2d", "autoScale2d",
    ] as any[],
    toImageButtonOptions: {
      format: "png" as const,
      filename: `xplainml_${filename}`,
      height: title ? 640 : 600,
      width: 1000,
      scale: 2,
    },
    responsive: true,
  };
}