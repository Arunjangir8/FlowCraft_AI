export type HealthResponse = {
  success: boolean;
  message: string;
  data: {
    status: string;
    timestamp: string;
  };
};
