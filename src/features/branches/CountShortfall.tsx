import type { ShortAs } from "@/features/branches/areas";
import type { Area } from "@/features/branches/types";

/**
 * What a count that comes up short is recorded as, in one quiet line, only once it is short (owner, 2026-11-10):
 * "5 kg short · missing" in a store; "5 kg short · used" where stock is used bit by bit, the word a tap that makes it
 * missing for this count, and back. A count that finds more is never "used", so nothing shows then.
 */
export function CountShortfall({
  area,
  shortAs,
  short,
  onChange,
}: {
  area: Area;
  /** The choice for this count. */
  shortAs: ShortAs;
  /** How much short the typed figure is, when it is; null before anything's typed or when it isn't short. */
  short: string | null;
  onChange: (next: ShortAs) => void;
}) {
  if (!short) return null;
  // Used is only an answer where stock is used bit by bit (owner, 2026-11-09): a Store's shortfall is missing, with
  // nothing to change.
  const usedHere = area.shortIsUsed === true;
  const used = shortAs === "USED" && usedHere;
  return (
    <p className="text-sm text-neutral-700" data-count-shortfall={used ? "USED" : "MISSING"}>
      {short} short ·{" "}
      {usedHere ? (
        <button
          type="button"
          onClick={() => onChange(used ? "MISSING" : "USED")}
          aria-label={`${used ? "Used" : "Missing"} from the ${area.name}. Tap to make it ${used ? "missing" : "used"}`}
          className="font-semibold text-primary-700 underline decoration-dotted underline-offset-2"
        >
          {used ? "used" : "missing"}
        </button>
      ) : (
        "missing"
      )}
    </p>
  );
}
