'use client';
import { IconDots, IconTrash } from '@tabler/icons-react';
import { HistoryIcon, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { type ConversationItem, useConversationsQuery } from '@/hooks/use-conversations-query';

export function NavHistory() {
  const [open, setOpen] = useState(true);
  const [hover, setHover] = useState(false);

  const { data, loadMore, archive, remove, upsert } = useConversationsQuery();

  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();

  const handleArchive = async (conversation: ConversationItem) => {
    try {
      const restoreIndex = data?.items.findIndex(i => i.id === conversation.id) ?? -1;

      await archive(conversation.id, true);
      if (pathname === `/chat/${conversation.id}`) {
        router.replace('/');
      }

      remove(conversation.id); // UI optimistic sync

      toast.success('Conversation archived', {
        action: {
          label: 'Undo',
          onClick: async () => {
            await archive(conversation.id, false);

            upsert(conversation, restoreIndex); // restore to original position
            toast.success('Conversation restored');
          },
        },
      });
    } catch {
      toast.error('Failed to archive conversation');
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuButton
        onClick={() => setOpen(!open)}
        onMouseOver={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="pr-2 cursor-pointer"
      >
        <CollapsibleTrigger asChild>
          {hover ? (
            <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          ) : (
            <HistoryIcon />
          )}
        </CollapsibleTrigger>
        {/*TODO: 여기선 다른 액션을 쓸 수 있음 */}
        History
      </SidebarMenuButton>

      <CollapsibleContent>
        <SidebarMenuSub className="mr-0 pr-0">
          {data &&
            data.items.map(conversation => (
              <SidebarMenuSubItem key={conversation.id}>
                <div className="relative flex items-center group/item">
                  <SidebarMenuButton asChild>
                    <Link
                      className={`items-center block truncate whitespace-nowrap max-w-full text-xs rounded-sm transition-colors ${
                        pathname === `/chat/${conversation.id}`
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      }`}
                      href={`/chat/${conversation.id}`}
                      title={conversation.title!}
                      aria-current={pathname === `/chat/${conversation.id}` ? 'page' : undefined}
                    >
                      <span>{conversation.title}</span>
                    </Link>
                  </SidebarMenuButton>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction className="opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-accent rounded-sm">
                        <IconDots />
                        <span className="sr-only">More</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      className="w-24 rounded-lg"
                      side={isMobile ? 'bottom' : 'right'}
                      align={isMobile ? 'end' : 'start'}
                    >
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={e => {
                          e.preventDefault();
                          void handleArchive(conversation);
                        }}
                      >
                        <IconTrash />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </SidebarMenuSubItem>
            ))}
          {data?.nextCursor && (
            <SidebarMenuSubItem>
              <SidebarMenuButton
                className="w-full text-muted-foreground cursor-pointer hover:text-foreground transition"
                onClick={async () => await loadMore()}
              >
                <IconDots />
                <span>More</span>
              </SidebarMenuButton>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
