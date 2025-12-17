"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { PageShell, Surface } from "@/components/ds/Surface";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { NumberInput } from "@/components/ds/NumberInput";
import { MONTHS } from "@/lib/digitalSnapshot";
import {
  BrandMonthlyPlan,
  BrandMonthlyActuals,
  clearBrandMonthlyActuals,
  clearBrandMonthlyPlan,
  computeBrandTargets,
  loadBrandMonthlyActuals,
  loadBrandMonthlyPlan,
  saveBrandMonthlyActuals,
  saveBrandMonthlyPlan
} from "@/lib/brandStorage";
import { useEffect, useMemo, useState } from "react";

type FormState = {
  salesTargetSqft: string;
  averageDealSizeSqft: string;
  digitalTargetPercent: string;
  allocatedBudgetDigital: string;
  expectedLeadVolume: string;
  expectedQualifiedPercent: string;
  actualBudgetSpentDigital: string;
  actualDealsWon: string;
  actualLeadsGenerated: string;
  actualQualifiedLeads: string;
  actualMeetingsScheduled: string;
  actualQualifiedMeetingsCompleted: string;
};

function toNumber(value: string) {
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

function toOptionalFiniteNumber(value: string) {
  if (value.trim() === "") return undefined;
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

export default function BrandDataEntryPage() {
  const [year, setYear] = useState(2025);
  const [monthIndex, setMonthIndex] = useState(11);
  const monthLabel = useMemo(() => `${MONTHS[monthIndex]} ${year}`, [monthIndex, year]);

  const [status, setStatus] = useState<"idle" | "saved" | "cleared" | "error">("idle");
  const [form, setForm] = useState<FormState>({
    salesTargetSqft: "",
    averageDealSizeSqft: "",
    digitalTargetPercent: "",
    allocatedBudgetDigital: "",
    expectedLeadVolume: "",
    expectedQualifiedPercent: "",
    actualBudgetSpentDigital: "",
    actualDealsWon: "",
    actualLeadsGenerated: "",
    actualQualifiedLeads: "",
    actualMeetingsScheduled: "",
    actualQualifiedMeetingsCompleted: ""
  });

  useEffect(() => {
    const saved = loadBrandMonthlyPlan(monthIndex, year);
    const savedActuals = loadBrandMonthlyActuals(monthIndex, year);
    if (!saved) {
      setForm((prev) => ({ ...prev }));
      setStatus("idle");
    } else {
      setForm((prev) => ({
        ...prev,
        salesTargetSqft: String(saved.salesTargetSqft ?? ""),
        averageDealSizeSqft: String(saved.averageDealSizeSqft ?? ""),
        digitalTargetPercent: String(saved.digitalTargetPercent ?? ""),
        allocatedBudgetDigital: String(saved.allocatedBudgetDigital ?? ""),
        expectedLeadVolume: String(saved.expectedLeadVolume ?? ""),
        expectedQualifiedPercent: String(saved.expectedQualifiedPercent ?? "")
      }));
      setStatus("saved");
    }

    if (!savedActuals) return;
    setForm((prev) => ({
      ...prev,
      actualBudgetSpentDigital: savedActuals.budgetSpentDigital != null ? String(savedActuals.budgetSpentDigital) : "",
      actualDealsWon: savedActuals.dealsWon != null ? String(savedActuals.dealsWon) : "",
      actualLeadsGenerated: savedActuals.leadsGenerated != null ? String(savedActuals.leadsGenerated) : "",
      actualQualifiedLeads: savedActuals.qualifiedLeads != null ? String(savedActuals.qualifiedLeads) : "",
      actualMeetingsScheduled: savedActuals.meetingsScheduled != null ? String(savedActuals.meetingsScheduled) : "",
      actualQualifiedMeetingsCompleted:
        savedActuals.qualifiedMeetingsCompleted != null ? String(savedActuals.qualifiedMeetingsCompleted) : ""
    }));
  }, [monthIndex, year]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  }

  function onSave() {
    const salesTargetSqft = toNumber(form.salesTargetSqft);
    const averageDealSizeSqft = toNumber(form.averageDealSizeSqft);
    const digitalTargetPercent = toNumber(form.digitalTargetPercent);
    const allocatedBudgetDigital = toNumber(form.allocatedBudgetDigital);
    const expectedLeadVolume = toNumber(form.expectedLeadVolume);
    const expectedQualifiedPercent = toNumber(form.expectedQualifiedPercent);

    if (
      salesTargetSqft == null ||
      averageDealSizeSqft == null ||
      digitalTargetPercent == null ||
      allocatedBudgetDigital == null ||
      expectedLeadVolume == null ||
      expectedQualifiedPercent == null
    ) {
      setStatus("error");
      return;
    }

    const payload: BrandMonthlyPlan = {
      monthIndex,
      year,
      salesTargetSqft,
      averageDealSizeSqft,
      digitalTargetPercent,
      allocatedBudgetDigital,
      expectedLeadVolume,
      expectedQualifiedPercent
    };

    saveBrandMonthlyPlan(payload);

    const budgetSpentDigital = toOptionalFiniteNumber(form.actualBudgetSpentDigital);
    const dealsWon = toOptionalFiniteNumber(form.actualDealsWon);
    const leadsGenerated = toOptionalFiniteNumber(form.actualLeadsGenerated);
    const qualifiedLeads = toOptionalFiniteNumber(form.actualQualifiedLeads);
    const meetingsScheduled = toOptionalFiniteNumber(form.actualMeetingsScheduled);
    const qualifiedMeetingsCompleted = toOptionalFiniteNumber(form.actualQualifiedMeetingsCompleted);

    const touchedActual =
      form.actualBudgetSpentDigital.trim() !== "" ||
      form.actualDealsWon.trim() !== "" ||
      form.actualLeadsGenerated.trim() !== "" ||
      form.actualQualifiedLeads.trim() !== "" ||
      form.actualMeetingsScheduled.trim() !== "" ||
      form.actualQualifiedMeetingsCompleted.trim() !== "";
    const invalidActual =
      budgetSpentDigital === null ||
      dealsWon === null ||
      leadsGenerated === null ||
      qualifiedLeads === null ||
      meetingsScheduled === null ||
      qualifiedMeetingsCompleted === null;

    // If the user filled any actual field, require that all filled values are valid numbers.
    if (touchedActual && invalidActual) {
      setStatus("error");
      return;
    }

    if (touchedActual) {
      const actualsPayload: BrandMonthlyActuals = {
        monthIndex,
        year,
        budgetSpentDigital: budgetSpentDigital ?? undefined,
        dealsWon: dealsWon ?? undefined,
        leadsGenerated: leadsGenerated ?? undefined,
        qualifiedLeads: qualifiedLeads ?? undefined,
        meetingsScheduled: meetingsScheduled ?? undefined,
        qualifiedMeetingsCompleted: qualifiedMeetingsCompleted ?? undefined
      };
      saveBrandMonthlyActuals(actualsPayload);
    }

    setStatus("saved");
  }

  function onClear() {
    clearBrandMonthlyPlan(monthIndex, year);
    clearBrandMonthlyActuals(monthIndex, year);
    setStatus("cleared");
  }

  const computed = useMemo(() => {
    const salesTargetSqft = toNumber(form.salesTargetSqft);
    const averageDealSizeSqft = toNumber(form.averageDealSizeSqft);
    const digitalTargetPercent = toNumber(form.digitalTargetPercent);
    const allocatedBudgetDigital = toNumber(form.allocatedBudgetDigital);
    const expectedLeadVolume = toNumber(form.expectedLeadVolume);
    const expectedQualifiedPercent = toNumber(form.expectedQualifiedPercent);
    if (
      salesTargetSqft == null ||
      averageDealSizeSqft == null ||
      digitalTargetPercent == null ||
      allocatedBudgetDigital == null ||
      expectedLeadVolume == null ||
      expectedQualifiedPercent == null
    ) {
      return null;
    }
    return computeBrandTargets({
      monthIndex,
      year,
      salesTargetSqft,
      averageDealSizeSqft,
      digitalTargetPercent,
      allocatedBudgetDigital,
      expectedLeadVolume,
      expectedQualifiedPercent
    });
  }, [
    form.salesTargetSqft,
    form.averageDealSizeSqft,
    form.digitalTargetPercent,
    form.allocatedBudgetDigital,
    form.expectedLeadVolume,
    form.expectedQualifiedPercent,
    monthIndex,
    year
  ]);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageShell>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight text-white/95">Brand Data Entry</div>
              <div className="text-sm text-white/55">
                Enter month-level inputs. Dashboards will use these values (fallback to dummy data when not provided).
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MonthYearPicker
                monthIndex={monthIndex}
                year={year}
                label={monthLabel}
                onChange={(next) => {
                  setMonthIndex(next.monthIndex);
                  setYear(next.year);
                }}
              />
              <Button as={Link} href="/" size="sm" variant="flat" className="glass-inset text-white/80">
                Back to home
              </Button>
            </div>
          </div>
        </PageShell>

        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/60">
              {status === "saved"
                ? "Saved for this month."
                : status === "cleared"
                  ? "Cleared for this month."
                  : status === "error"
                    ? "Please fill all required fields with valid numbers."
                    : " "}
            </div>
            <div className="flex items-center gap-2">
              <Button onPress={onClear} variant="flat" className="glass-inset text-white/80">
                Clear month
              </Button>
              <Button onPress={onSave} color="primary">
                Save
              </Button>
              <Button
                as={Link}
                href="/digital/monthly-snapshot"
                variant="flat"
                className="glass-inset text-white/80"
              >
                Open Monthly Snapshot
              </Button>
            </div>
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-7">
            <div className="mb-4">
              <div className="text-lg font-semibold text-white/90">Inputs (required)</div>
              <div className="text-sm text-white/55">We compute qualified leads and meeting targets from these.</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <NumberInput
                label="Sales Target"
                unit="sqft"
                placeholder="25000"
                value={form.salesTargetSqft}
                onValueChange={(v) => update("salesTargetSqft", v)}
              />
              <NumberInput
                label="Average Deal Size"
                unit="sqft"
                placeholder="850"
                value={form.averageDealSizeSqft}
                onValueChange={(v) => update("averageDealSizeSqft", v)}
              />
              <NumberInput
                label="Target from Digital"
                unit="%"
                placeholder="30"
                value={form.digitalTargetPercent}
                onValueChange={(v) => update("digitalTargetPercent", v)}
                description="What percent of the sales target should come from digital."
              />
              <NumberInput
                label="Allocated Budget (Digital)"
                unit="PKR"
                placeholder="12000000"
                value={form.allocatedBudgetDigital}
                onValueChange={(v) => update("allocatedBudgetDigital", v)}
              />
              <NumberInput
                label="Expected Lead Volume"
                unit="leads"
                placeholder="1500"
                value={form.expectedLeadVolume}
                onValueChange={(v) => update("expectedLeadVolume", v)}
              />
              <NumberInput
                label="Expected Qualified Rate"
                unit="%"
                placeholder="25"
                value={form.expectedQualifiedPercent}
                onValueChange={(v) => update("expectedQualifiedPercent", v)}
              />
            </div>
          </Surface>

          <Surface className="md:col-span-5">
            <div className="mb-4">
              <div className="text-lg font-semibold text-white/90">How we calculate targets</div>
              <div className="text-sm text-white/55">Live preview updates as you type.</div>
            </div>

            <div className="space-y-3 text-sm text-white/70">
              <div className="glass-inset rounded-xl p-3">
                <div className="font-semibold text-white/85">1) Deals required</div>
                <div className="mt-1">
                  Deals = ceil(Sales Target ÷ Avg Deal Size)
                </div>
              </div>
              <div className="glass-inset rounded-xl p-3">
                <div className="font-semibold text-white/85">2) Digital deals required</div>
                <div className="mt-1">
                  Digital Deals = ceil(Deals × %Digital)
                </div>
              </div>
              <div className="glass-inset rounded-xl p-3">
                <div className="font-semibold text-white/85">3) Qualified meetings required</div>
                <div className="mt-1">
                  Meetings = Deals × 2
                </div>
              </div>
              <div className="glass-inset rounded-xl p-3">
                <div className="font-semibold text-white/85">4) Digital qualified meetings required</div>
                <div className="mt-1">
                  Digital Meetings = Digital Deals × 2
                </div>
              </div>
              <div className="glass-inset rounded-xl p-3">
                <div className="font-semibold text-white/85">5) Qualified leads target</div>
                <div className="mt-1">
                  Qualified Leads = round(Expected Leads × %Qualified)
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-white/45">Computed outputs (preview)</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Deals required</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">{computed ? computed.dealsRequired : "—"}</div>
                </div>
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Digital deals required</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">
                    {computed ? computed.digitalDealsRequired : "—"}
                  </div>
                </div>
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Qualified meetings required</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">
                    {computed ? computed.qualifiedMeetingsRequired : "—"}
                  </div>
                </div>
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Digital qualified meetings required</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">
                    {computed ? computed.digitalQualifiedMeetingsRequired : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Expected leads</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">{computed ? computed.targetLeads : "—"}</div>
                </div>
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Qualified leads target</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">
                    {computed ? computed.targetQualifiedLeads : "—"}
                  </div>
                </div>
              </div>
            </div>
          </Surface>
        </div>

        <Surface>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Actuals (so far)</div>
              <div className="mt-1 text-sm text-white/55">
                Optional. Update anytime as the month progresses. These override dummy values in the dashboard.
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <NumberInput
              label="Budget Spent (Digital)"
              unit="PKR"
              placeholder="9000000"
              value={form.actualBudgetSpentDigital}
              onValueChange={(v) => update("actualBudgetSpentDigital", v)}
            />
            <NumberInput
              label="Deals Won"
              unit="deals"
              placeholder="6"
              value={form.actualDealsWon}
              onValueChange={(v) => update("actualDealsWon", v)}
            />
            <NumberInput
              label="Leads Generated"
              unit="leads"
              placeholder="1000"
              value={form.actualLeadsGenerated}
              onValueChange={(v) => update("actualLeadsGenerated", v)}
            />
            <NumberInput
              label="Qualified Leads"
              unit="leads"
              placeholder="200"
              value={form.actualQualifiedLeads}
              onValueChange={(v) => update("actualQualifiedLeads", v)}
            />
            <NumberInput
              label="Meetings Scheduled"
              unit="meetings"
              placeholder="50"
              value={form.actualMeetingsScheduled}
              onValueChange={(v) => update("actualMeetingsScheduled", v)}
            />
            <NumberInput
              label="Qualified Meetings Completed"
              unit="meetings"
              placeholder="35"
              value={form.actualQualifiedMeetingsCompleted}
              onValueChange={(v) => update("actualQualifiedMeetingsCompleted", v)}
            />
          </div>
        </Surface>
      </div>
    </main>
  );
}



