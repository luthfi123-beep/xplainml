"use client";

import { ColumnInfo, ColumnConfig } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Props {
  col: ColumnInfo;
  config: ColumnConfig | undefined;
  isTarget: boolean;
  onChange: (update: Partial<ColumnConfig>) => void;
}

export function ColumnConfigRow({ col, config, isTarget, onChange }: Props) {
  if (!config) return null;

  const isIncluded = config.include !== false;

  return (
    <div className={`grid grid-cols-12 gap-3 py-3 items-center text-sm ${!isIncluded ? "opacity-40" : ""}`}>
      {/* Include toggle */}
      <div className="col-span-1 flex justify-center">
        <Switch
          checked={isIncluded}
          onCheckedChange={(v) => onChange({ include: v })}
          disabled={isTarget}
        />
      </div>

      {/* Column name */}
      <div className="col-span-3 flex items-center gap-2">
        <span className="font-mono font-medium truncate">{col.name}</span>
        {isTarget && <Badge className="text-xs bg-blue-400/20 text-blue-400 border-blue-400/30">target</Badge>}
      </div>

      {/* Type badge */}
      <div className="col-span-2">
        <Badge variant="outline" className={`text-xs ${
          col.type === "numerical" ? "border-blue-400/50 text-blue-400" : "border-purple-400/50 text-purple-400"
        }`}>
          {col.type}
        </Badge>
      </div>

      {/* Missing info */}
      <div className="col-span-2 text-muted-foreground text-xs">
        {col.missing > 0 ? (
          <span className="text-orange-400">{col.missing_pct}% missing</span>
        ) : (
          <span className="text-green-400/70">No missing</span>
        )}
      </div>

      {/* Missing strategy */}
      <div className="col-span-2">
        {!isTarget && (
          <Select
            value={config.missing_strategy}
            onValueChange={(v) => onChange({ missing_strategy: v })}
            disabled={!isIncluded}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {col.type === "numerical" && (
                <>
                  <SelectItem value="mean">Mean</SelectItem>
                  <SelectItem value="median">Median</SelectItem>
                </>
              )}
              <SelectItem value="mode">Mode</SelectItem>
              <SelectItem value="constant">Constant</SelectItem>
              <SelectItem value="drop">Drop rows</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Encoding */}
      <div className="col-span-2">
        {col.type === "categorical" && !isTarget && (
          <Select
            value={config.encoding || "none"}
            onValueChange={(v) => onChange({ encoding: v === "none" ? null : v })}
            disabled={!isIncluded}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No encoding</SelectItem>
              <SelectItem value="label">Label</SelectItem>
              <SelectItem value="onehot">One-Hot</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}