import * as React from "react";
import { cn } from "@/lib/utils";
function Card({className,...props}:React.ComponentProps<"div">){return <div className={cn("flex flex-col gap-6 rounded-xl border py-6",className)} {...props}/>}
function CardContent({className,...props}:React.ComponentProps<"div">){return <div className={cn("px-6",className)} {...props}/>}
export{Card,CardContent};
