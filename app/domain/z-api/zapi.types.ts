export type SendTextRequest = {
  phone: string;
  message: string;
};

export type SendVideoRequest = {
  phone: string;
  video: string;
  delayMessage?: number;
  caption?: string;
  viewOnce?: boolean;
};

export type SendMessageResponse = {
  id?: string;
  messageId?: string;
  status?: string;
  errors?: any;
  [key: string]: any;
};

export type Contact = {
  id?: string;
  phone?: string;
  pushname?: string;
  name?: string;
  [key: string]: any;
};

export type ContactsResponse = {
  data?: Contact[];
  page?: number;
  pageSize?: number;
  total?: number;
  [key: string]: any;
};
