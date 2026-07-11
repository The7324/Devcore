import { CloudflareClient } from "@/providers/cloudflare/client";

export interface CfStreamVideo {
  uid: string;
  creator?: string;
  thumbnail: string;
  thumbnailTokenExpires?: string;
  readyToStream: boolean;
  readyToStreamAt?: string;
  status: { state: string; step?: string; pctComplete?: number };
  meta: Record<string, string>;
  created: string;
  modified: string;
  size: number;
  duration: number;
  input: { width: number; height: number };
  playback: { hls: string; dash: string };
}

export class CloudflareStream {
  constructor(
    private readonly client: CloudflareClient,
    private readonly accountId: string,
  ) {}

  async listVideos(): Promise<CfStreamVideo[]> {
    const { data } = await this.client.get<CfStreamVideo[]>(`/accounts/${this.accountId}/stream`);
    return data.result;
  }

  async getVideo(uid: string): Promise<CfStreamVideo> {
    const { data } = await this.client.get<CfStreamVideo>(`/accounts/${this.accountId}/stream/${uid}`);
    return data.result;
  }

  async deleteVideo(uid: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/stream/${uid}`);
  }
}

export function streamVideoSummary(v: CfStreamVideo): string {
  const status = v.status.state;
  const dur = `${Math.floor(v.duration / 60)}:${Math.floor(v.duration % 60).toString().padStart(2, "0")}`;
  return `${v.uid.slice(0, 8)}… — ${dur} — ${status}`;
}
