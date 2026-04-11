import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";

export function PublicHomePage() {
  return (
    <main className="app-content">
      <div className="page-stack">
        <section className="hero-panel">
          <p className="chip">Official Home Page</p>
          <h1>CollabWorkSpace</h1>
          <p className="muted-text">
            Nền tảng cộng tác công việc và nội dung theo thời gian thực dành cho nhóm, dự án và tổ chức.
          </p>
          <div className="inline-actions">
            <Link to="/login" className="link-button">Đăng nhập</Link>
            <Link to="/register" className="link-button">Đăng ký</Link>
            <Link to="/workspaces" className="link-button">Vào ứng dụng</Link>
          </div>
        </section>

        <Card>
          <h2 className="card-subtitle">Thông tin pháp lý</h2>
          <p>
            Để tìm hiểu cách chúng tôi xử lý dữ liệu và các điều kiện sử dụng dịch vụ, vui lòng tham khảo các
            tài liệu chính thức dưới đây.
          </p>
          <div className="inline-actions">
            <Link to="/privacy-policy" className="link-button">Chính sách bảo mật</Link>
            <Link to="/terms" className="link-button">Điều khoản sử dụng</Link>
          </div>
        </Card>

        <Card>
          <h2 className="card-subtitle">Thông tin liên hệ</h2>
          <p>
            Email hỗ trợ: <a href="mailto:lehuynhhuyhoang05@gmail.com">lehuynhhuyhoang05@gmail.com</a>
          </p>
          <p>
            Website: <a href="https://api.huyhoang05.id.vn/">https://api.huyhoang05.id.vn/</a>
          </p>
        </Card>
      </div>
    </main>
  );
}

export default PublicHomePage;
