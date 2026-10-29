import { redirect } from "next/navigation";

// 루트로 들어온 사람에게 편집 화면이 열리지 않도록 읽기 전용 완성본으로 보낸다.
export default function Home() {
  redirect("/view");
}
