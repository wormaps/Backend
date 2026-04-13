import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSceneDataDir } from '../../../storage/scene-storage.utils';
import type {
  SceneFidelityPlan,
  SceneOracleApprovalStatus,
} from '../../../types/scene.types';

interface OracleApprovalFilePayload {
  state?: 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  note?: string;
}

export async function resolveSceneOracleApproval(args: {
  sceneId: string;
  phase?: SceneFidelityPlan['phase'];
}): Promise<SceneOracleApprovalStatus> {
  const { sceneId, phase } = args;
  if (phase !== 'PHASE_3_PRODUCTION_LOCK') {
    return {
      required: false,
      state: 'NOT_REQUIRED',
      source: 'auto',
    };
  }

  const approvalFilePath = join(
    getSceneDataDir(),
    `${sceneId}.oracle-approval.json`,
  );

  let raw = '';
  try {
    raw = await readFile(approvalFilePath, 'utf8');
  } catch {
    return {
      required: true,
      state: 'PENDING',
      source: 'approval_file',
      approvalFilePath,
      note: 'Oracle approval file is missing.',
    };
  }

  let parsed: OracleApprovalFilePayload | null = null;
  try {
    parsed = JSON.parse(raw) as OracleApprovalFilePayload;
  } catch {
    return {
      required: true,
      state: 'PENDING',
      source: 'approval_file',
      approvalFilePath,
      note: 'Oracle approval file is not valid JSON.',
    };
  }

  if (parsed?.state === 'APPROVED') {
    return {
      required: true,
      state: 'APPROVED',
      source: 'approval_file',
      approvalFilePath,
      approvedBy: parsed.approvedBy,
      approvedAt: parsed.approvedAt,
      note: parsed.note,
    };
  }

  if (parsed?.state === 'REJECTED') {
    return {
      required: true,
      state: 'REJECTED',
      source: 'approval_file',
      approvalFilePath,
      approvedBy: parsed.approvedBy,
      approvedAt: parsed.approvedAt,
      note: parsed.note,
    };
  }

  return {
    required: true,
    state: 'PENDING',
    source: 'approval_file',
    approvalFilePath,
    note: 'Oracle approval state must be APPROVED or REJECTED.',
  };
}
