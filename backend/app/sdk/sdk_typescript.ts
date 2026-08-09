import axios, { AxiosInstance } from 'axios';

export interface TenantDetails {
  tenant_id: number;
  name: string;
  subdomain: string;
  custom_domain?: string;
  status: string;
}

export class TravelOSClient {
  private client: AxiosInstance;

  constructor(apiKey: string, baseUrl: string = 'https://api.travelos.com/api/v1') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-API-Key': apiKey,
        'X-Tenant-ID': '1',
        'Content-Type': 'application/json'
      }
    });
  }

  public async getTenantDetails(): Promise<TenantDetails> {
    const response = await this.client.get<TenantDetails>('/tenant/me');
    return response.data;
  }

  public async searchGlobal(query: string): Promise<any> {
    const response = await this.client.get('/search', { params: { q: query } });
    return response.data;
  }

  public async postWebhookEvent(eventType: string, payload: any): Promise<any> {
    const response = await this.client.post('/events/emit', payload, {
      params: { event_type: eventType }
    });
    return response.data;
  }
}
