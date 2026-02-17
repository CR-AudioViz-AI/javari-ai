import JavariOSLayout from "./JavariOSLayout";
import JavariOSFrame from "./JavariOSFrame";
import JavariChatScreen from "./JavariChatScreen";

export default function Page() {
  return (
    <JavariOSLayout>
      <JavariOSFrame>
        <JavariChatScreen />
      </JavariOSFrame>
    </JavariOSLayout>
  );
}
