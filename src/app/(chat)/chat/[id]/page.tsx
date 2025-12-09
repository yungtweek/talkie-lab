import NotFound from 'next/dist/client/components/builtin/not-found';
import { redirect } from 'next/navigation';
import React from 'react';

import { auth } from '@/app/(auth)/auth';
import { ArtifactProvider } from '@/components/artifact-provider';
import { Chat } from '@/components/chat';
import { InferenceConfigProvider } from '@/components/inference-config-provider';
import {
  findConversationById,
  findConversationStateByConversationId,
  listMessagesByConversationId,
} from '@/lib/repositories/conversation-repository';
import { getPromptMetadata, listPromptsByMetadataId } from '@/lib/repositories/prompt-repository';

export default async function ChatPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const chat = await findConversationById(id);
  const isYourChat = chat?.userId != null && session?.user?.id === chat.userId;
  if (!chat || !isYourChat) {
    return NotFound;
  }
  const messages = await listMessagesByConversationId(id);
  const state = await findConversationStateByConversationId(id);
  let promptMetadata = undefined;
  if (state && state.promptMetadataId) {
    const prompts = await listPromptsByMetadataId(state.promptMetadataId);
    promptMetadata = { prompts: prompts };
  }

  return (
    <>
      <ArtifactProvider>
        <InferenceConfigProvider>
          <Chat
            conversationId={id}
            initialMessages={messages}
            initialState={state}
            initialPromptData={promptMetadata}
          />
        </InferenceConfigProvider>
      </ArtifactProvider>
    </>
  );
}
