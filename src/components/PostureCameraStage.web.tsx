import React from 'react';

interface Props {
  active: boolean;
  onFrame: (frame: never) => void;
  onReady: () => void;
  onError: (message: string) => void;
}

export const PostureCameraStage: React.FC<Props> = () => null;
