export interface ChatInputProps {
  onSubmit?:    (text: string) => void;
  placeholder?: string;
  disabled?:    boolean;
  suggestions?: string[];
  // P6-09D
  value?:       string;
}

export default function ChatInput({
  placeholder = '',
  disabled    = false,
  value,
}: ChatInputProps) {
  return (
    <div data-disabled={disabled ? 'true' : 'false'}>
      <textarea
        data-field="input"
        placeholder={placeholder}
        disabled={disabled}
        defaultValue={value}
      />
      <button
        data-field="send"
        disabled={disabled}
      >
        Gửi
      </button>
    </div>
  );
}
