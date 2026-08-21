import { cn } from "@/lib/utils";
import * as React from "react";
function Textarea({className,...props}:React.ComponentProps<"textarea">){return <textarea className={cn("min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base outline-none",className)} {...props}/>}
export{Textarea};
