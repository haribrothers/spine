import { render, screen } from "@testing-library/react-native";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Text } from "react-native";

describe("Card a11y", () => {
  it("CardTitle exposes a header role so it's announced as a heading, not plain text", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>Kitchen renovation</CardDescription>
        </CardHeader>
        <CardContent>
          <Text>Contract value: $12,000</Text>
        </CardContent>
        <CardFooter>
          <Text>Footer</Text>
        </CardFooter>
      </Card>,
    );
    const heading = screen.getByRole("header");
    expect(heading).toBeTruthy();
    expect(screen.getByText("Job details")).toBeTruthy();
  });
});
