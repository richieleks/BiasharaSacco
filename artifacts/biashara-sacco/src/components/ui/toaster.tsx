import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

const variantIcons = {
  default: { icon: Info, className: "text-blue-500" },
  success: { icon: CheckCircle2, className: "text-emerald-600" },
  destructive: { icon: XCircle, className: "text-red-600" },
  warning: { icon: AlertTriangle, className: "text-amber-600" },
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const variantKey = (variant || "default") as keyof typeof variantIcons
        const { icon: Icon, className: iconClassName } = variantIcons[variantKey] || variantIcons.default
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-3 items-start">
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconClassName}`} />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
