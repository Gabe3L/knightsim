import type { FieldOverlaySample, OverlayPose } from '../overlays/fieldOverlays';
import { telemetryAt } from './mockReplay';

const pose = (xM: number, yM: number, yawDeg: number): OverlayPose => ({ xM, yM, yawDeg });

const groundTruthAt = (timeS: number): OverlayPose => {
  const replayPose = telemetryAt(timeS);
  return pose(
    replayPose.xM + Math.sin(timeS / 8.5) * 0.035,
    replayPose.yM - Math.cos(timeS / 10.2) * 0.025,
    replayPose.yawDeg + Math.sin(timeS / 9) * 0.7,
  );
};

export function odometryDebugAt(timeS: number): readonly FieldOverlaySample[] {
  const replayPose = telemetryAt(timeS);
  const fused = pose(replayPose.xM, replayPose.yM, replayPose.yawDeg);
  const truth = groundTruthAt(timeS);
  const tag7 = pose(
    fused.xM + Math.sin(timeS * 0.82) * 0.13,
    fused.yM + Math.cos(timeS * 0.73) * 0.1,
    fused.yawDeg + Math.sin(timeS / 2.4) * 2.2,
  );
  const tag12 = pose(
    fused.xM - 0.2 + Math.cos(timeS * 0.54) * 0.16,
    fused.yM + 0.16 + Math.sin(timeS * 0.61) * 0.13,
    fused.yawDeg - 4.5 + Math.cos(timeS / 2.9) * 2.8,
  );
  const lidar = pose(
    fused.xM + Math.sin(timeS / 3.1) * 0.075,
    fused.yM + Math.cos(timeS / 3.7) * 0.065,
    fused.yawDeg + Math.sin(timeS / 4.6) * 1.1,
  );
  const imuPath = Array.from({ length: 9 }, (_, index) => {
    const sampleTimeS = Math.max(0, timeS - 2.4 + index * 0.4);
    const sample = telemetryAt(sampleTimeS);
    const drift = Math.max(0, sampleTimeS - Math.max(0, timeS - 2.4));
    return pose(
      sample.xM + drift * 0.022,
      sample.yM - drift * 0.014,
      sample.yawDeg + drift * 0.75,
    );
  });
  const tag12Available = timeS < 30 || timeS > 36;
  const lidarAvailable = timeS < 55 || timeS > 59;

  return [
    {
      id: 'infantry.odometry.apriltag.7',
      available: true,
      pose: tag7,
      covariance: { majorM: 0.22, minorM: 0.1, angleDeg: tag7.yawDeg + 18 },
      status: 'accepted',
      residualToFused: fused,
    },
    tag12Available ? {
      id: 'infantry.odometry.apriltag.12',
      available: true,
      pose: tag12,
      covariance: { majorM: 0.38, minorM: 0.16, angleDeg: tag12.yawDeg - 24 },
      status: Math.floor(timeS / 6) % 2 === 0 ? 'accepted' : 'rejected',
      residualToFused: fused,
    } : {
      id: 'infantry.odometry.apriltag.12',
      available: false,
      unavailableReason: 'Tag is outside the current camera view',
    },
    lidarAvailable ? {
      id: 'infantry.odometry.lidar',
      available: true,
      pose: lidar,
      covariance: { majorM: 0.14, minorM: 0.09, angleDeg: lidar.yawDeg },
      status: 'accepted',
      residualToFused: fused,
    } : {
      id: 'infantry.odometry.lidar',
      available: false,
      unavailableReason: 'Scan matcher is reacquiring',
    },
    {
      id: 'infantry.odometry.imu',
      available: true,
      pose: imuPath.at(-1),
      path: imuPath,
      covariance: { majorM: 0.26, minorM: 0.12, angleDeg: imuPath.at(-1)?.yawDeg ?? 0 },
      status: 'predicted',
    },
    replayPose.connected ? {
      id: 'infantry.odometry.fused',
      available: true,
      pose: fused,
      covariance: { majorM: 0.1, minorM: 0.065, angleDeg: fused.yawDeg },
      status: 'accepted',
    } : {
      id: 'infantry.odometry.fused',
      available: false,
      unavailableReason: 'Odometry stream is temporarily disconnected',
    }
  ];
}
