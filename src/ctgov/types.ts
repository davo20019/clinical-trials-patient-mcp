export interface TrialLocation {
  facility: string;
  city: string;
  state: string | null;
  country: string;
  recruitingStatus: string | null;
  contacts: TrialContact[];
}

export interface TrialContact {
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
}

export interface TrialSummary {
  nctId: string;
  title: string;
  briefSummary: string;
  phase: string | null;
  status: string;
  conditions: string[];
  locations: TrialLocation[];
  sponsor: string;
  lastUpdated: string;
  officialUrl: string;
}

export interface TrialDetails {
  identification: {
    nctId: string;
    title: string;
    officialTitle: string;
  };
  summary: {
    briefSummary: string;
    detailedDescription: string | null;
  };
  status: {
    overallStatus: string;
    startDate: string | null;
    completionDate: string | null;
    lastUpdated: string;
  };
  design: {
    phase: string | null;
    studyType: string;
    enrollmentCount: number | null;
    allocation: string | null;
  };
  eligibility: {
    minimumAge: string | null;
    maximumAge: string | null;
    sex: string;
    healthyVolunteers: boolean;
    criteria: string;
  };
  locations: TrialLocation[];
  sponsor: {
    leadSponsor: string;
    collaborators: string[];
  };
  interventions: Array<{
    type: string;
    name: string;
    description: string | null;
  }>;
  references: {
    pubmedIds: string[];
    officialUrl: string;
  };
}

export interface ConditionMatch {
  condition: string;
  synonyms: string[];
  studyCount: number;
}

export interface SearchResult {
  totalCount: number;
  trials: TrialSummary[];
}

export type PhaseFilter = "1" | "2" | "3" | "4" | "any";
export type StatusFilter = "recruiting" | "not_yet_recruiting" | "any";

export interface SearchParams {
  condition: string;
  location?: string;
  status?: StatusFilter;
  phase?: PhaseFilter;
  pageSize?: number;
}
