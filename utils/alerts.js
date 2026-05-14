import Swal from 'sweetalert2';

export const showToast = (title, icon = 'success') => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1E293B',
    color: '#fff',
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  Toast.fire({
    icon,
    title
  });
};

export const showAlert = (title, text, icon = 'info') => {
  return Swal.fire({
    title,
    text,
    icon,
    background: '#1E293B',
    color: '#fff',
    confirmButtonColor: '#3B82F6',
    customClass: {
      popup: 'rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl',
      title: 'font-black tracking-tight',
      confirmButton: 'rounded-xl px-8 py-3 font-bold uppercase tracking-widest text-xs'
    }
  });
};

export const showConfirm = (title, text, icon = 'warning', confirmText = 'Đồng ý', cancelText = 'Hủy') => {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor: '#EF4444',
    cancelButtonColor: '#64748B',
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    background: '#1E293B',
    color: '#fff',
    customClass: {
      popup: 'rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl',
      title: 'font-black tracking-tight',
      confirmButton: 'rounded-xl px-6 py-3 font-bold uppercase tracking-widest text-xs',
      cancelButton: 'rounded-xl px-6 py-3 font-bold uppercase tracking-widest text-xs'
    }
  });
};
