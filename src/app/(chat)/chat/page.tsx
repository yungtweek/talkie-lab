import React from 'react';

import { ArtifactProvider } from '@/components/artifact-provider';
import { Chat } from '@/components/chat';
import { InferenceConfigProvider } from '@/components/inference-config-provider';
import { generateUUID } from '@/lib/utils';

export default function ChatPage() {
  const id = generateUUID();
  return (
    <>
      <ArtifactProvider>
        <InferenceConfigProvider>
          <Chat conversationId={id} />
        </InferenceConfigProvider>
      </ArtifactProvider>
    </>
  );
}
