import { open, showHUD } from "@raycast/api";

export default async function Kickoff() {
  await open("drip://kickoff");
  await showHUD("Kickoff started");
}
