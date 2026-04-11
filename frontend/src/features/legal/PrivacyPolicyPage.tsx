import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";

export function PrivacyPolicyPage() {
  return (
    <main className="app-content">
      <div className="page-stack">
        <Card>
          <p className="chip">Privacy Policy</p>
          <h1 className="card-title">Chính Sách Bảo Mật</h1>
          <p className="muted-text">Cập nhật lần cuối: 11/04/2026</p>
          <p>
            CloudCollab tôn trọng và cam kết bảo vệ quyền riêng tư của người dùng. Chính sách này mô tả
            cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin khi bạn truy cập hoặc sử dụng dịch vụ.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">1. Dữ liệu chúng tôi thu thập</h2>
          <p>Thông tin tài khoản: họ tên, email, ảnh đại diện (nếu bạn cung cấp).</p>
          <p>Dữ liệu nội dung: workspace, page, block, comment và tệp do bạn tạo hoặc tải lên.</p>
          <p>Dữ liệu kỹ thuật: nhật ký truy cập, thông tin thiết bị/trình duyệt cơ bản và dữ liệu chẩn đoán lỗi.</p>
        </Card>

        <Card>
          <h2 className="card-subtitle">2. Mục đích sử dụng dữ liệu</h2>
          <p>Cung cấp chức năng đăng nhập, phân quyền, đồng bộ và cộng tác theo thời gian thực.</p>
          <p>Cải thiện chất lượng dịch vụ, phát hiện sự cố và tăng cường an toàn hệ thống.</p>
          <p>Thực hiện các tích hợp tùy chọn như Google Calendar/Meet khi bạn chủ động cấp quyền kết nối.</p>
        </Card>

        <Card>
          <h2 className="card-subtitle">3. Chia sẻ dữ liệu</h2>
          <p>
            Chúng tôi không bán dữ liệu cá nhân của bạn. Dữ liệu chỉ được chia sẻ với các nhà cung cấp hạ tầng
            cần thiết để vận hành dịch vụ (ví dụ: lưu trữ tệp, cơ sở dữ liệu, email hệ thống), trên nguyên tắc
            tối thiểu và đúng mục đích sử dụng.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">4. Bảo mật dữ liệu</h2>
          <p>Dữ liệu được bảo vệ bằng các biện pháp kỹ thuật và vận hành phù hợp trong phạm vi hệ thống.</p>
          <p>
            Bạn có trách nhiệm bảo mật thông tin đăng nhập của mình. Nếu phát hiện truy cập bất thường,
            vui lòng đổi mật khẩu ngay và thông báo cho quản trị viên hệ thống.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">5. Quyền của người dùng</h2>
          <p>
            Bạn có thể cập nhật thông tin hồ sơ, thu hồi kết nối Google và yêu cầu chỉnh sửa/xóa dữ liệu
            theo quy định pháp luật áp dụng.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">6. Liên hệ</h2>
          <p>
            Nếu bạn có câu hỏi liên quan đến Chính sách bảo mật, vui lòng liên hệ qua email:
            lehuynhhuyhoang05@gmail.com.
          </p>
          <div className="inline-actions">
            <Link to="/login" className="link-button">
              Quay về đăng nhập
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default PrivacyPolicyPage;
