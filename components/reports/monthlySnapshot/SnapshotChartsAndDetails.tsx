"use client";

import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useState } from "react";
import { FunnelComparisonLineChart } from "@/components/charts/FunnelComparisonLineChart";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { ConversionFlow } from "@/components/charts/ConversionFlow";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import type { PlanChannel } from "@/lib/dashboardDb";
import { formatNumber } from "@/lib/format";

export function SnapshotChartsAndDetails(props: {
  contributionRows: { stage: string; target: number; actual: number; variance: number }[];
  leadToQualifiedPct: number;
  leadToQualifiedAddressedPct?: number | null;
  addressedLeads?: number | null;
  notContacted?: number | null;
  leadToQualifiedTargetPct?: number | null;
  qualifiedToMeetingPct: number;
  qualifiedToMeetingTargetPct?: number | null;
  meetingToClosePct: number;
  meetingToCloseTargetPct?: number | null;
  meetingToCloseNote?: string | null;
  rows: { metric: string; value: string }[];
  channel: PlanChannel;
}) {
  const {
    contributionRows,
    leadToQualifiedPct,
    leadToQualifiedAddressedPct,
    addressedLeads,
    notContacted,
    leadToQualifiedTargetPct,
    qualifiedToMeetingPct,
    qualifiedToMeetingTargetPct,
    meetingToClosePct,
    meetingToCloseTargetPct,
    meetingToCloseNote,
    rows
  } = props;

  const [useAddressed, setUseAddressed] = useState(false);

  const effectiveLeadToQualifiedPct =
    useAddressed && typeof leadToQualifiedAddressedPct === "number" ? leadToQualifiedAddressedPct : leadToQualifiedPct;

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-12">
        <Surface className="md:col-span-7">
          <div className="mb-4">
            <div className="text-lg font-semibold text-white/90">Contribution to Funnel</div>
            <div className="mt-1 text-sm text-white/55">Target vs actual</div>
          </div>

          <FunnelComparisonLineChart
            points={contributionRows.map((r) => ({ label: r.stage, target: r.target, actual: r.actual }))}
            formatNumber={formatNumber}
          />
        </Surface>

        <Surface className="md:col-span-5">
          <div className="mb-4">
            <div className="text-lg font-semibold text-white/90">Contribution Details</div>
          </div>

          <TargetActualBars items={contributionRows.map((r) => ({ stage: r.stage, target: r.target, actual: r.actual }))} formatNumber={formatNumber} />
        </Surface>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-12">
        <Surface className="md:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold text-white/90">Funnel</div>
            <div className="text-sm text-white/55">This month</div>
          </div>
          <div className="mb-2 text-sm font-semibold text-white/80">Leads → Qualified → Meetings → Close</div>
          <div className="text-sm text-white/55">Conversion rates from actuals.</div>
          {meetingToCloseNote ? <div className="mt-2 text-xs text-white/45">{meetingToCloseNote}</div> : null}

          {typeof addressedLeads === "number" && typeof notContacted === "number" && addressedLeads >= 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AppButton
                intent="primary"
                className="h-9 px-4"
                isDisabled={notContacted <= 0}
                onPress={() => setUseAddressed((v) => !v)}
              >
                {useAddressed ? "Compute for total leads" : "Compute for addressed leads"}
              </AppButton>
              {useAddressed ? (
                <div className="text-xs text-white/55">
                  Addressed leads: <span className="font-semibold text-white/80">{formatNumber(addressedLeads)}</span>{" "}
                  <span className="text-white/40">({formatNumber(notContacted)} not contacted)</span>
                </div>
              ) : notContacted > 0 ? (
                <div className="text-xs text-white/55">
                  Ratios based on all leads (
                  <span className="font-semibold text-white/80">{formatNumber(addressedLeads + notContacted)}</span>)
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5">
            <ConversionFlow
              steps={[
                {
                  from: "Leads",
                  to: "Qualified",
                  percent: effectiveLeadToQualifiedPct,
                  targetPercent: leadToQualifiedTargetPct ?? null,
                  colorClassName: "bg-emerald-400"
                },
                {
                  from: "Qualified",
                  to: "Meeting",
                  percent: qualifiedToMeetingPct,
                  targetPercent: qualifiedToMeetingTargetPct ?? null,
                  colorClassName: "bg-fuchsia-400"
                },
                {
                  from: "Meeting",
                  to: "Close",
                  percent: meetingToClosePct,
                  targetPercent: meetingToCloseTargetPct ?? null,
                  colorClassName: "bg-blue-400"
                }
              ]}
            />
          </div>
        </Surface>

        <Surface className="md:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold text-white/90">Details</div>
          </div>

          <div className="glass-inset rounded-2xl">
            <Table aria-label="Monthly snapshot metrics" removeWrapper className="text-white/80">
              <TableHeader>
                <TableColumn className="text-white/50">Metric</TableColumn>
                <TableColumn className="text-white/50">Value</TableColumn>
              </TableHeader>
              <TableBody items={rows}>
                {(item) => (
                  <TableRow key={item.metric} className="odd:bg-white/0 even:bg-white/[0.02]">
                    <TableCell className="text-white/60">{item.metric}</TableCell>
                    <TableCell className="font-medium text-white/90">{item.value}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Surface>
      </div>
    </>
  );
}
