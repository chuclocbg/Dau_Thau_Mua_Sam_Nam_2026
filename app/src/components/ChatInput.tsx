export interface ChatInputProps {
  onSubmit?: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  suggestions?: string[];
}

export default function ChatInput(_props: ChatInputProps) {
  return <div>ChatInput</div>;
}
