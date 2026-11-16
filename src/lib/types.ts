export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "error";

export interface DownloadDTO {
  id: string;
  url: string;
  filename: string;
  status: DownloadStatus;
  receivedBytes: number;
  totalBytes: number | null;
  speed: number;
  etaSeconds: number | null;
  error: string | null;
  contentType: string | null;
  createdAt: string;
}
