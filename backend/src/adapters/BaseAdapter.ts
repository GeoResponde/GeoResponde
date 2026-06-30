import { HumanitarianProvider, NormalizedSearchResult, SubmissionPackage } from '@georesponde/shared';

export interface BaseAdapter {
  provider: HumanitarianProvider;
  search(query: string, domain?: string): Promise<NormalizedSearchResult[]>;
  submit(pkg: SubmissionPackage): Promise<{ success: boolean; referenceId?: string }>;
  getGeoJSON?(): Promise<any>;
}
