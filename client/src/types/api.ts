export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type Plan = {
  name: string;
  displayName: string;
};

export type Subscription = {
  status: string;
  currentPeriodEnd: string;
  plan: Plan;
};

export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  subscription?: Subscription | null;
};