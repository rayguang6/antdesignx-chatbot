'use client';

import {
  AppstoreAddOutlined,
  CloudUploadOutlined,
  CommentOutlined,
  CopyOutlined,
  DeleteOutlined,
  DislikeOutlined,
  EditOutlined,
  EllipsisOutlined,
  FileSearchOutlined,
  HeartOutlined,
  LikeOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ProductOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  ShareAltOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import {
  Attachments,
  Bubble,
  BubbleProps,
  Conversations,
  Prompts,
  Sender,
  Welcome,
  useXAgent,
  useXChat,
} from '@ant-design/x';
import { Avatar, Button, Flex, type GetProp, Space, Spin, Typography, message, Modal, Input } from 'antd';
import type { User } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_CONVERSATIONS_ITEMS,
  DEFAULT_MESSAGES_BY_CONV,
  HOT_TOPICS,
  DESIGN_GUIDE,
  SENDER_PROMPTS,
} from './lib/constants';
import { supabase } from './lib/supabaseClient';
import { useStyle } from './styles';
import markdownit from 'markdown-it';
import { fetchConversations, createConversation, deleteConversation, renameConversation } from './chat/lib/db/conversations'
import { fetchMessages, insertMessage } from './chat/lib/db/messages'
import { MessageInfo } from '@ant-design/x/es/use-x-chat';


type BubbleDataType = {
  role: string;
  content: string;
};

type ConversationItem = {
  key: string
  label: string
  group: string
}


const Independent: React.FC = () => {
  const md = markdownit({ html: true, breaks: true });

  const { styles } = useStyle();
  const abortController = useRef<AbortController>(null);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ==================== State ====================
  // const [messageHistory, setMessageHistory] = useState<Record<string, any>>({});
  
  // const [messageHistory, setMessageHistory] = useState<Record<string, any[]>>(DEFAULT_MESSAGES_BY_CONV);
  // const [conversations, setConversations] = useState(DEFAULT_CONVERSATIONS_ITEMS);
  // const [curConversation, setCurConversation] = useState(DEFAULT_CONVERSATIONS_ITEMS[0].key);
  const [messageHistory, setMessageHistory] = useState<Record<string, any[]>>({});
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [curConversation, setCurConversation] = useState<string | undefined>(undefined);


  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<GetProp<typeof Attachments, 'items'>>([]);

  const [inputValue, setInputValue] = useState('');

  // to save chunks from assistant
  const pendingAssistant = useRef<string>('');
  const streamConvRef = useRef<string | null>(null);
  const prevLoadingRef = useRef<boolean>(false);

  const [modal, contextHolder] = Modal.useModal();


  // ==================== Load Session ====================
  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      setUser(session.user);
      setCheckingAuth(false);
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // ==================== Load Conversations ====================
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const rows = await fetchConversations(user.id)
        const formatted = rows.map((r) => ({
          key: r.id,
          label: r.title || 'Untitled',
          group: dayjs(r.created_at).format('YYYY-MM-DD'),
        }))
        setConversations(formatted)
  
        // if (formatted.length) setCurConversation(formatted[0].key)
      } catch (err: any) {
        message.error('Failed to load conversations')
        console.error(err)
      }
    })()
  }, [user])
  
  // ==================== Handlers ====================

  const handleSignOut = async () => {
    setCheckingAuth(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      message.error(error.message);
      setCheckingAuth(false);
      return;
    }

    message.success('Signed out successfully.');
  };

  const handleNewConversation = async () => {
    if (agent.isRequesting()) {
      message.error('Request in progress. Abort or wait before creating a new chat.');
      return;
    }
    if (!user) return;
  
    try {
      const row = await createConversation(user.id, `New Conversation ${conversations.length + 1}`);
  
      const item = {
        key: row.id,
        label: row.title || 'Untitled',
        group: dayjs(row.created_at).format('YYYY-MM-DD'),
      };
  
      setConversations([item, ...conversations]);
      setCurConversation(row.id);
      setMessages([]); // fresh chat area
    } catch (err: any) {
      console.error(err);
      message.error('Failed to create conversation.');
    }
  };

  // Rename
const handleRenameConversation = (conv: ConversationItem) => {
  let nextTitle = conv.label;

  modal.confirm({
    title: 'Rename conversation',
    content: (
      <Input
        autoFocus
        defaultValue={conv.label}
        onChange={(e) => (nextTitle = e.target.value)}
        placeholder="Conversation title"
      />
    ),
    okText: 'Save',
    onOk: async () => {
      const clean = (nextTitle ?? '').trim();
      if (!clean || clean === conv.label) return;

      try {
        const row = await renameConversation(conv.key, clean);
        // update local list label
        setConversations((prev) =>
          prev.map((i) => (i.key === conv.key ? { ...i, label: row.title || clean } : i)),
        );
        message.success('Renamed');
      } catch (err) {
        console.error(err);
        message.error('Failed to rename conversation');
        throw err; // keep modal open if desired
      }
    },
  });
};

// Delete
const handleDeleteConversation = (conv: ConversationItem) => {
  modal.confirm({
    title: 'Delete this conversation?',
    content: 'All messages in this conversation will be permanently removed.',
    okText: 'Delete',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await deleteConversation(conv.key);
        setConversations((prev) => prev.filter((i) => i.key !== conv.key));

        if (curConversation === conv.key) {
          setCurConversation(undefined);
          setMessages([]); // clear chat area
        }

        message.success('Conversation deleted');
      } catch (err) {
        console.error(err);
        message.error('Failed to delete conversation');
        throw err; // keep modal open if desired
      }
    },
  });
};
  
  

  /**
   * 🔔 Please replace the BASE_URL, PATH, MODEL, API_KEY with your own values.
   */

  // ==================== Runtime ====================
  const [agent] = useXAgent<BubbleDataType>({
    baseURL: '/api/chat',
    model: 'deepseek-reasoner',
  });

  const renderMarkdown: BubbleProps['messageRender'] = (content) => {
    return (
      <Typography>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: used in demo */}
        <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
      </Typography>
    );
  };

  const loading = agent.isRequesting();

  const { onRequest, messages, setMessages } = useXChat({
    agent,
    requestFallback: (_, { error }) => {
      if (error.name === 'AbortError') {
        return {
          content: 'Request is aborted',
          role: 'assistant',
        };
      }
      return {
        content: 'Request failed, please try again!',
        role: 'assistant',
      };
    },
    transformMessage: (info) => {
      const { originMessage, chunk } = info || {};
      let currentContent = '';
      let currentThink = '';
    
      try {
        if (chunk?.data && !chunk.data.includes('DONE')) {
          const message = JSON.parse(chunk.data);
          currentThink = message?.choices?.[0]?.delta?.reasoning_content || '';
          currentContent = message?.choices?.[0]?.delta?.content || '';
        }
      } catch (error) {
        console.error(error);
      }
    
      // accumulate assistant tokens (visible content only) for DB save after stream ends
      if (currentContent) {
        pendingAssistant.current += currentContent;
      }
    
      // --- simple version (no <think>) ---
      const content = `${originMessage?.content || ''}${currentContent || ''}`;
    
      // let content = '';
      // if (!originMessage?.content && currentThink) {
      //   content = `<think>${currentThink}`;
      // } else if (
      //   originMessage?.content?.includes('<think>') &&
      //   !originMessage?.content.includes('</think>') &&
      //   currentContent
      // ) {
      //   content = `${originMessage?.content}</think>${currentContent}`;
      // } else {
      //   content = `${originMessage?.content || ''}${currentThink}${currentContent}`;
      // }
    
      return {
        content: content,
        role: 'assistant',
      };
    },
    
    resolveAbortController: (controller) => {
      abortController.current = controller;
    },
  });

  // ==================== Event ====================
  // const onSubmit = (val: string) => {
  //   if (!val) return;

  //   if (loading) {
  //     message.error('Request is in progress, please wait for the request to complete.');
  //     return;
  //   }

  //   onRequest({
  //     stream: true,
  //     message: { role: 'user', content: val },
  //   });
  // };
  const onSubmit = async (val: string) => {
    if (!val) return;
    if (loading) { message.error('Request is in progress, please wait.'); return; }
    if (!user) return;
  
    try {
      // ensure we have a conversation id
      let convId = curConversation;
      if (!convId) {
        const row = await createConversation(user.id, `New Conversation ${conversations.length + 1}`);
        const item = { key: row.id, label: row.title || 'Untitled', group: dayjs(row.created_at).format('YYYY-MM-DD') };
        setConversations([item, ...conversations]);
        setCurConversation(row.id);
        setMessages([]);
        convId = row.id;
      }
  
      // 🔑 mark stream context + reset assistant buffer
      streamConvRef.current = convId!;
      pendingAssistant.current = '';
  
      // save the user's message first
      await insertMessage(convId!, 'user', val);
    } catch (err) {
      console.error(err);
      // continue so the UX still streams a reply
    }
  
    onRequest({ stream: true, message: { role: 'user', content: val } });
    setInputValue('');
  };
  
  

  // ==================== Nodes ====================
  const chatSider = (
    <div className={styles.sider}>
      {/* 🌟 Logo */}
      <div className={styles.logo}>
        <img
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxs1dGqKW7H1yWPi2u8zoud7MFQqEITq3tYg&s"
          draggable={false}
          alt="logo"
          width={24}
          height={24}
        />
        <span>AIA GPT</span>
      </div>

      {/* 🌟 添加会话 */}

      {/* <Button
        onClick={() => {
          if (agent.isRequesting()) {
            message.error(
              'Message is Requesting, you can create a new conversation after request done or abort it right now...',
            );
            return;
          }

          const now = dayjs().valueOf().toString();
          setConversations([
            {
              key: now,
              label: `New Conversation ${conversations.length + 1}`,
              group: 'Today',
            },
            ...conversations,
          ]);
          setCurConversation(now);
          setMessages([]);
        }}
        type="link"
        className={styles.addBtn}
        icon={<PlusOutlined />}
      >
        New Conversation
      </Button> */}
      <Button
        onClick={handleNewConversation}
        type="link"
        className={styles.addBtn}
        icon={<PlusOutlined />}
        >
          New Conversation
      </Button>


      {/* 🌟 会话管理 */}
      <Conversations
        items={conversations}
        className={styles.conversations}
        activeKey={curConversation}
        onActiveChange={async (val) => {
          try {
            abortController.current?.abort()
            setCurConversation(val)
        
            const rows = await fetchMessages(val)
            const bubbles = rows.map((m) => ({
              id: m.id,
              status: 'idle',
              message: { role: m.role, content: m.content },
            }))
        
            setMessages(bubbles as MessageInfo<BubbleDataType>[])
          } catch (err: any) {
            console.error(err)
            message.error('Failed to load messages')
          }
        }}
        
        // onActiveChange={async (val) => {
        //   abortController.current?.abort();
        //   // The abort execution will trigger an asynchronous requestFallback, which may lead to timing issues.
        //   // In future versions, the sessionId capability will be added to resolve this problem.
        //   setTimeout(() => {
        //     setCurConversation(val);
        //     setMessages(messageHistory?.[val] || []);
        //   }, 100);
        // }}
        groupable
        styles={{ item: { padding: '0 8px' } }}
        menu={(conversation) => ({
          items: [
            {
              label: 'Rename',
              key: 'rename',
              icon: <EditOutlined />,
              onClick: () => handleRenameConversation(conversation as ConversationItem),

            },
            {
              label: 'Delete',
              key: 'delete',
              icon: <DeleteOutlined />,
              danger: true,
              onClick: () => handleDeleteConversation(conversation as ConversationItem),
            },
          ],
        })}
      />

      <div className={styles.siderFooter}>
        <Avatar size={24} />
        <Button type="text" icon={<QuestionCircleOutlined />} />
      </div>
    </div>
  );
  const chatList = (
    <div className={styles.chatList}>
      {messages?.length ? (
        /* 🌟 消息列表 */
        <Bubble.List
  items={messages?.map((i) => {
    const role = i.message?.role;
    const raw  = String(i.message?.content ?? '');

    return {
      ...i.message,
      // keep your existing bits
      classNames: {
        content: i.status === 'loading' ? styles.loadingMessage : '',
      },
      typing: i.status === 'loading' ? { step: 5, interval: 20, suffix: <>💗</> } : false,

      // ✅ add this line: use markdown renderer for assistant messages
      messageRender: role === 'assistant' ? renderMarkdown : undefined,

      // keep content as plain string; the renderer receives it
      content: raw,
    };
  })}
  style={{ height: '100%', paddingInline: 'calc(calc(100% - 700px) /2)' }}
  roles={{
    assistant: {
      placement: 'start',
      footer: (
        <div style={{ display: 'flex' }}>
          <Button type="text" size="small" icon={<ReloadOutlined />} />
          <Button type="text" size="small" icon={<CopyOutlined />} />
          <Button type="text" size="small" icon={<LikeOutlined />} />
          <Button type="text" size="small" icon={<DislikeOutlined />} />
        </div>
      ),
      loadingRender: () => <Spin size="small" />,
    },
    user: { placement: 'end' },
  }}
/>

      ) : (
        <Space
          direction="vertical"
          size={16}
          style={{ paddingInline: 'calc(calc(100% - 700px) /2)' }}
          className={styles.placeholder}
        >
          <Welcome
            variant="borderless"
            icon="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxs1dGqKW7H1yWPi2u8zoud7MFQqEITq3tYg&s"
            title="Hello, I'm AIA Assistant"
            description="Ask sifu anything"
            // extra={
            //   <Space>
            //     <Button icon={<ShareAltOutlined />} />
            //     <Button icon={<EllipsisOutlined />} />
            //   </Space>
            // }
          />
          <Flex gap={16}>
            <Prompts
              items={[HOT_TOPICS]}
              styles={{
                list: { height: '100%' },
                item: {
                  flex: 1,
                  backgroundImage: 'linear-gradient(123deg, #e5f4ff 0%, #efe7ff 100%)',
                  borderRadius: 12,
                  border: 'none',
                },
                subItem: { padding: 0, background: 'transparent' },
              }}
              onItemClick={(info) => {
                onSubmit(info.data.description as string);
              }}
              className={styles.chatPrompt}
            />

            <Prompts
              items={[DESIGN_GUIDE]}
              styles={{
                item: {
                  flex: 1,
                  backgroundImage: 'linear-gradient(123deg, #e5f4ff 0%, #efe7ff 100%)',
                  borderRadius: 12,
                  border: 'none',
                },
                subItem: { background: '#ffffffa6' },
              }}
              onItemClick={(info) => {
                onSubmit(info.data.description as string);
              }}
              className={styles.chatPrompt}
            />
          </Flex>
        </Space>
      )}
    </div>
  );
  
  const senderHeader = (
    <Sender.Header
      title="Upload File"
      open={attachmentsOpen}
      onOpenChange={setAttachmentsOpen}
      styles={{ content: { padding: 0 } }}
    >
      <Attachments
        beforeUpload={() => false}
        items={attachedFiles}
        onChange={(info) => setAttachedFiles(info.fileList)}
        placeholder={(type) =>
          type === 'drop'
            ? { title: 'Drop file here' }
            : {
                icon: <CloudUploadOutlined />,
                title: 'Upload files',
                description: 'Click or drag files to this area to upload',
              }
        }
      />
    </Sender.Header>
  );
  const chatSender = (
    <>
      {/* 🌟 提示词 */}
      <Prompts
        items={SENDER_PROMPTS}
        onItemClick={(info) => {
          onSubmit(info.data.description as string);
        }}
        styles={{
          item: { padding: '6px 12px' },
        }}
        className={styles.senderPrompt}
      />
      {/* 🌟 输入框 */}
      <Sender
        value={inputValue}
        header={senderHeader}
        onSubmit={() => {
          onSubmit(inputValue);
          setInputValue('');
        }}
        onChange={setInputValue}
        onCancel={() => {
          // 👇 don’t save partial assistant replies on abort
          pendingAssistant.current = '';
          streamConvRef.current = null;
          abortController.current?.abort();
        }}
        prefix={
          <Button
            type="text"
            icon={<PaperClipOutlined style={{ fontSize: 18 }} />}
            onClick={() => setAttachmentsOpen(!attachmentsOpen)}
          />
        }
        loading={loading}
        className={styles.sender}
        allowSpeech
        actions={(_, info) => {
          const { SendButton, LoadingButton, SpeechButton } = info.components;
          return (
            <Flex gap={4}>
              <SpeechButton className={styles.speechButton} />
              {loading ? <LoadingButton type="default" /> : <SendButton type="primary" />}
            </Flex>
          );
        }}
        placeholder="Ask or input / use skills"
      />
    </>
  );

  // useEffect(() => {
  //   if (!curConversation) return;
  //   const initial = messageHistory[curConversation] || [];
  //   setMessages(initial);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);
  

  useEffect(() => {
    // history mock
    if (messages?.length && curConversation) {
      setMessageHistory((prev) => ({
        ...prev,
        [curConversation]: messages,
      }));
    }
  }, [messages]);

  useEffect(() => {
    const prev = prevLoadingRef.current;
    if (prev && !loading) {
      // stream just finished
      const final = pendingAssistant.current.trim();
      const conversationId = streamConvRef.current;
  
      if (final && conversationId) {
        insertMessage(conversationId, 'assistant', final)
          .catch((e) => console.error('Save assistant failed:', e));
      }
  
      // cleanup
      pendingAssistant.current = '';
      streamConvRef.current = null;
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  const userSummary = user ? (
    <Flex
      align="center"
      justify="space-between"
      style={{
        padding: '16px calc(calc(100% - 700px) /2)',
        borderBottom: '1px solid #f0f0f0',
        gap: 16,
      }}
    >
      <Flex align="center" gap={12}>
        <Avatar size={40}>{user.email?.[0]?.toUpperCase() ?? 'U'}</Avatar>
        <div>
          <Typography.Text strong>{user.email ?? 'Authenticated user'}</Typography.Text>
          <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
            User ID: {user.id}
          </Typography.Paragraph>
        </div>
      </Flex>
      <Button onClick={handleSignOut}>Sign out</Button>
    </Flex>
  ) : null;

  if (checkingAuth) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (!user) {
    return null;
  }

  // ==================== Render =================
  return (
    <div className={styles.layout}>
        {contextHolder}

      {chatSider}

      <div className={styles.chat}>
        {userSummary}
        {chatList}
        {chatSender}
      </div>
    </div>
  );
};

export default Independent;