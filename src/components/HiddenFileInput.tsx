"use client";

import { useEffect, useState, type InputHTMLAttributes, type Ref } from "react";

export function HiddenFileInput({
  inputRef,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) return null;
  return <input {...props} ref={inputRef} type="file" className="hidden" />;
}
