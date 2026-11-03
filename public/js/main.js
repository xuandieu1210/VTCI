// ========================================
// VIEN THONG CONG ICH - MAIN JAVASCRIPT
// ========================================

$(document).ready(function() {
    'use strict';

    // ===== SIDEBAR TOGGLE =====
    $('#sidebarToggle').on('click', function() {
        $('#sidebar').toggleClass('active');
    });

    // Auto close sidebar on click outside (mobile)
    $(document).on('click', function(e) {
        if ($(window).width() <= 992) {
            if (!$(e.target).closest('#sidebar').length && 
                !$(e.target).closest('#sidebarToggle').length) {
                $('#sidebar').removeClass('active');
            }
        }
    });

    // ===== AUTO HIDE ALERTS =====
    setTimeout(function() {
        $('.alert').fadeOut('slow');
    }, 5000);

    // ===== CONFIRM DELETE =====
    $('.btn-delete').on('click', function(e) {
        e.preventDefault();
        var url = $(this).data('url');
        var name = $(this).data('name') || 'dữ liệu này';
        
        Swal.fire({
            title: 'Xác nhận xóa?',
            text: 'Bạn có chắc chắn muốn xóa ' + name + '?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = url;
            }
        });
    });

    // ===== DATA TABLE =====
    if ($.fn.DataTable) {
        $('.datatable').DataTable({
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
            },
            responsive: true,
            pageLength: 10,
            lengthChange: true
        });
    }

    // ===== TOOLTIP =====
    if ($.fn.tooltip) {
        $('[data-bs-toggle="tooltip"]').tooltip();
    }

    // ===== POPOVER =====
    if ($.fn.popover) {
        $('[data-bs-toggle="popover"]').popover();
    }

    console.log('🚀 Vien Thong Cong Ich - System ready!');
});