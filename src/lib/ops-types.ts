export type OpsReport = {
  id: string;
  targetType: "user" | "post" | "comment" | "shop" | "live";
  targetId: string;
  reporterId?: string;
  source: "console" | "robot" | "user";
  reason: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  notes: string;
  createdAt: string;
  resolvedAt?: string;
};

export type OpsAudit = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: string;
};

export type OpsWithdrawal = {
  id: string;
  userId: string;
  amountMicros: number;
  amountLabel: string;
  status: "pending" | "approved" | "rejected" | "paid";
  method: string;
  notes: string;
  createdAt: string;
  resolvedAt?: string;
};
