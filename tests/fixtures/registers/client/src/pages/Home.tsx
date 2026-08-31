/* Control fixture: a component holding two pieces of state under a ceiling of four. */
export default function Home() {
  const [a, setA] = useState(1);
  const [b, setB] = useState<string>("");
  return [a, b, setA, setB];
}
