'use client';

import { startTransition, useEffect, useRef } from 'react';

import { type UIArtifact } from '@/hooks/use-artifact';

import type React from 'react';

const getLastUserMessage = (container: HTMLElement | null) => {
  if (!container) return null;
  const nodes = container.querySelectorAll<HTMLElement>('div[role="user"]');
  return nodes.length ? nodes[nodes.length - 1] : null;
};

const getOffsetTopWithin = (container: HTMLElement, target: HTMLElement) => {
  let offset = 0;
  let el: HTMLElement | null = target;
  while (el && el !== container) {
    offset += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return offset;
};

export function useAssistantSelectionOnScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  setSelectedMessageId: (id: string) => void,
  isStreaming?: boolean,
) {
  useEffect(() => {
    if (isStreaming) return;

    const container = containerRef.current;
    if (!container) return;

    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;

        const containerRect = container.getBoundingClientRect();
        const focusY = containerRect.top + containerRect.height * 0.3;

        const nodes = Array.from(
          container.querySelectorAll<HTMLElement>('[data-message-id][data-role="assistant"]'),
        );

        let best: { id: string; distance: number } | null = null;

        for (const el of nodes) {
          const rect = el.getBoundingClientRect();
          const isVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
          if (!isVisible) continue;

          const center = rect.top + rect.height / 2;
          const dist = Math.abs(focusY - center);
          const id = el.getAttribute('data-message-id');
          if (!id) continue;

          if (!best || dist < best.distance) {
            best = { id, distance: dist };
          }
        }

        if (best) {
          setSelectedMessageId(best.id);
        }
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [containerRef, setSelectedMessageId, isStreaming]);
}

export function useChatScrollAnchors(
  containerRef: React.RefObject<HTMLDivElement | null>,
  artifactState: UIArtifact,
  messages: Array<{ role: string }>,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const lastUser = getLastUserMessage(container);
    if (!lastUser) return;

    const top = getOffsetTopWithin(container, lastUser) - 46;
    container.scrollTo({ top, behavior: 'smooth' });
  }, [messages.length, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const artifactEl = container.querySelector('[data-artifact]');
    const sentinelEl = container.querySelector('[data-scroll-sentinel]');
    if (!artifactEl && !sentinelEl) return;

    let prevScrollHeight = container.scrollHeight;
    const nearBottomThreshold = 200;

    const observer = new ResizeObserver(entries => {
      if (!entries.length) return;
      const nextScrollHeight = container.scrollHeight;
      const distanceFromBottom = nextScrollHeight - (container.scrollTop + container.clientHeight);
      const delta = nextScrollHeight - prevScrollHeight;
      prevScrollHeight = nextScrollHeight;

      if (distanceFromBottom <= nearBottomThreshold) {
        container.scrollTo({ top: nextScrollHeight, behavior: 'auto' });
      } else if (delta > 0) {
        container.scrollTop += delta;
      }
    });

    if (artifactEl) observer.observe(artifactEl);
    if (sentinelEl) observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [artifactState.status, artifactState.content, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const artifactEl = container.querySelector<HTMLElement>('[data-artifact]');
    if (!artifactEl) return;

    const artifactTop = getOffsetTopWithin(container, artifactEl);
    const artifactBottom = artifactTop + artifactEl.getBoundingClientRect().height;
    const viewBottom = container.scrollTop + container.clientHeight;
    const margin = 24;

    if (artifactBottom > viewBottom) {
      const targetTop = Math.max(0, artifactBottom - container.clientHeight + margin);
      container.scrollTo({ top: targetTop, behavior: 'auto' });
    }
  }, [artifactState.content, artifactState.status, containerRef]);
}

export function useSelectLatestAssistantMessage(
  messages: Array<{ id: string; role: string }>,
  setSelectedMessageId: (id: string) => void,
) {
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const prevLength = prevLengthRef.current;
    const nextLength = messages.length;
    prevLengthRef.current = nextLength;

    if (nextLength <= prevLength) return;
    if (nextLength === 0) return;

    const last = messages[nextLength - 1];
    if (last.role !== 'assistant') return;

    startTransition(() => setSelectedMessageId(last.id));
  }, [messages, setSelectedMessageId]);
}
