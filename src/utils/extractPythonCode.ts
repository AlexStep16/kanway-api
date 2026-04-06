export const extractPythonCode = (text: string): string => {
  const match = text.match(/```python\n?([\s\S]*?)```/i)
  return match ? match[1].trim() : text.trim()
}
