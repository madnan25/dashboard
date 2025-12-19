import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
  unit?: string;
  description?: string;
  descriptionTone?: "muted" | "danger";
  className?: string;
};

export function NumberInput(props: Props) {
  return (
    <div className={cn("space-y-1.5", props.className)}>
      <div className="text-sm text-white/70">{props.label}</div>
      <div
        className={cn(
          "glass-inset flex items-center gap-2 rounded-xl px-3 py-2.5 focus-within:ring-1 focus-within:ring-white/15",
          props.isDisabled ? "opacity-60" : ""
        )}
      >
        <input
          value={props.value}
          onChange={(e) => props.onValueChange(e.target.value)}
          placeholder={props.placeholder}
          inputMode="decimal"
          disabled={props.isDisabled}
          className="w-full bg-transparent text-white/90 placeholder:text-white/25 outline-none"
          aria-label={props.label}
        />
        {props.unit ? <span className="text-xs text-white/45">{props.unit}</span> : null}
      </div>
      {props.description ? (
        <div className={cn("text-xs", props.descriptionTone === "danger" ? "text-rose-200/90" : "text-white/40")}>
          {props.description}
        </div>
      ) : null}
    </div>
  );
}


