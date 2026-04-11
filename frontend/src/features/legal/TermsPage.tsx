import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";

export function TermsPage() {
  return (
    <main className="app-content">
      <div className="page-stack">
        <Card>
          <p className="chip">Terms of Service</p>
          <h1 className="card-title">Điều Khoản Sử Dụng</h1>
          <p className="muted-text">Cập nhật lần cuối: 11/04/2026</p>
          <p>
            Khi sử dụng CloudCollab, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ các điều khoản dưới đây.
            Nếu không đồng ý với bất kỳ nội dung nào, vui lòng ngừng sử dụng dịch vụ.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">1. Phạm vi dịch vụ</h2>
          <p>
            CloudCollab cung cấp nền tảng quản lý công việc và cộng tác nội dung. Chúng tôi có thể cập nhật
            hoặc điều chỉnh tính năng để cải thiện chất lượng dịch vụ.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">2. Tài khoản người dùng</h2>
          <p>Bạn chịu trách nhiệm đối với tài khoản và mọi hoạt động phát sinh từ tài khoản của mình.</p>
          <p>Không được chia sẻ thông tin đăng nhập cho bên thứ ba khi chưa được phép hợp lệ.</p>
        </Card>

        <Card>
          <h2 className="card-subtitle">3. Hành vi bị cấm</h2>
          <p>Không sử dụng dịch vụ để phát tán mã độc, tấn công hệ thống hoặc thực hiện hành vi trái pháp luật.</p>
          <p>Không thu thập hoặc khai thác dữ liệu người dùng khác trái phép, xâm phạm quyền riêng tư.</p>
        </Card>

        <Card>
          <h2 className="card-subtitle">4. Nội dung và sở hữu trí tuệ</h2>
          <p>
            Bạn giữ quyền sở hữu đối với nội dung do bạn tạo. Bạn cấp cho CloudCollab quyền cần thiết để
            lưu trữ và xử lý nội dung nhằm cung cấp dịch vụ theo đúng chức năng hệ thống.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">5. Giới hạn trách nhiệm</h2>
          <p>
            Dịch vụ được cung cấp trên cơ sở "như hiện có". Trong phạm vi pháp luật cho phép,
            CloudCollab không chịu trách nhiệm đối với các thiệt hại gián tiếp, mất dữ liệu hoặc gián đoạn kinh doanh.
          </p>
        </Card>

        <Card>
          <h2 className="card-subtitle">6. Liên hệ</h2>
          <p>Mọi thắc mắc về Điều khoản sử dụng, vui lòng liên hệ: lehuynhhuyhoang05@gmail.com.</p>
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

export default TermsPage;
