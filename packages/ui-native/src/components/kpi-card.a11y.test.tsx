import { render, screen } from "@testing-library/react-native";
import Wallet from "lucide-react-native/icons/wallet";
import { KpiCard } from "./kpi-card";

describe("KpiCard a11y", () => {
  it("renders the label, value, and trend text", () => {
    render(
      <KpiCard
        label="Outstanding"
        value="$42,300"
        trend="+8% this month"
        icon={Wallet}
        gradient={{ from: "#2954E5", to: "#2144BB" }}
        gradientId="primary"
      />,
    );
    expect(screen.getByText("Outstanding")).toBeTruthy();
    expect(screen.getByText("$42,300")).toBeTruthy();
    expect(screen.getByText("+8% this month")).toBeTruthy();
  });

  it("defaults to a 168px width when not given one", () => {
    const root = render(
      <KpiCard label="Outstanding" value="$42,300" trend="+8% this month" icon={Wallet} gradient={{ from: "#2954E5", to: "#2144BB" }} gradientId="primary" />,
    );
    const outer = root.UNSAFE_root.findAll((n) => n.props.style && (n.props.style as { width?: number }).width === 168);
    expect(outer.length).toBeGreaterThan(0);
  });

  it("respects an explicit width", () => {
    const root = render(
      <KpiCard
        label="Outstanding"
        value="$42,300"
        trend="+8% this month"
        icon={Wallet}
        gradient={{ from: "#2954E5", to: "#2144BB" }}
        gradientId="primary"
        width={200}
      />,
    );
    const outer = root.UNSAFE_root.findAll((n) => n.props.style && (n.props.style as { width?: number }).width === 200);
    expect(outer.length).toBeGreaterThan(0);
  });
});
